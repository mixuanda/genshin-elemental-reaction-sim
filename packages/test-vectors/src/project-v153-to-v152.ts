import {
  GCSIM_FREEZE_BROKEN_ATTACK_POLICY_V3_MODE,
  LEGACY_CALLBACK_BUS_POLICY_V1_MODE,
} from "@genshin-dps-lab/icd-profiles";
import {
  FREEZE_BROKEN_ATTACK_ENGINE_VERSION,
  FREEZE_BROKEN_ATTACK_RUN_MANIFEST_VERSION,
  FREEZE_BROKEN_ATTACK_SCHEMA_VERSION,
  assertTrustedSimulationResultV152,
  assertTrustedSimulationResultV153,
  createSimulationConfigHash,
  createSimulationReproducibilityKey,
  simulationResultV152Schema,
  simulationResultV153Schema,
  type SimConfigV152,
  type SimulationResultForV152,
  type SimulationResultForV153,
  type SimulationRunManifestV152,
} from "@genshin-dps-lab/schemas";

/**
 * Projects a current 1.53 result onto the exact frozen 1.52 public wire.
 *
 * Only the legacy callback-bus selection is representable. The V2 bus is a
 * new execution policy even when no callback happens to fire, so it must not
 * be treated as equivalent to the historical absence of a callback bus.
 * Likewise, V3 Freeze Broken rows carry callback delivery links that the 1.52
 * wire cannot express and therefore fail closed before any proof is removed.
 */
export function projectSimulationResultV153ToV152(
  result: SimulationResultForV153,
): SimulationResultForV152 {
  simulationResultV153Schema.parse(result);
  assertTrustedSimulationResultV153(result);

  const callbackCapabilityIndex =
    result.runManifest.pluginCapabilities.indexOf("callback-subscriber");
  if (callbackCapabilityIndex !== -1) {
    throw new Error(
      "V1.53 to V1.52 compatibility projection cannot represent " +
        `callback-subscriber capability at plugin index ${callbackCapabilityIndex}.`,
    );
  }

  const selectedCallbackBusModel = result.config.callbackBusModel;
  const selectedCallbackBusRoot = result.runManifest.callbackBusRoot;
  if (selectedCallbackBusRoot.policyId !== selectedCallbackBusModel.policyId) {
    throw new Error(
      "V1.53 callback-bus root policy does not match the policy selected " +
        "by config.",
    );
  }
  if (selectedCallbackBusModel.mode !== LEGACY_CALLBACK_BUS_POLICY_V1_MODE) {
    throw new Error(
      "V1.53 to V1.52 compatibility projection requires callback bus V1; " +
        `received ${selectedCallbackBusModel.mode}.`,
    );
  }
  if (result.callbackRegistrationLog.length !== 0) {
    throw new Error(
      "V1.53 to V1.52 compatibility projection requires an empty " +
        "callbackRegistrationLog; received " +
        `${result.callbackRegistrationLog.length} row(s).`,
    );
  }
  if (result.callbackDeliveryLog.length !== 0) {
    throw new Error(
      "V1.53 to V1.52 compatibility projection requires an empty " +
        "callbackDeliveryLog; received " +
        `${result.callbackDeliveryLog.length} row(s).`,
    );
  }
  const selectedFreezeBrokenModel = result.config.freezeBrokenAttackModel;
  const selectedFreezeBrokenRoot = result.runManifest.freezeBrokenAttackRoot;
  if (
    selectedFreezeBrokenRoot.policyId !== selectedFreezeBrokenModel.policyId
  ) {
    throw new Error(
      "V1.53 Freeze Broken root policy does not match the policy selected " +
        "by config.",
    );
  }
  if (
    selectedFreezeBrokenModel.mode ===
      GCSIM_FREEZE_BROKEN_ATTACK_POLICY_V3_MODE ||
    selectedFreezeBrokenRoot.mode === GCSIM_FREEZE_BROKEN_ATTACK_POLICY_V3_MODE
  ) {
    throw new Error(
      "V1.53 Freeze Broken V3 has no faithful V1.52 wire projection.",
    );
  }
  const v3FreezeBrokenRow = result.freezeBrokenAttackLog.find(
    (entry) => entry.executionStatus !== "reference-audit-only-not-dispatched",
  );
  if (v3FreezeBrokenRow !== undefined) {
    throw new Error(
      `V1.53 Freeze Broken row ${v3FreezeBrokenRow.id} carries V3 callback ` +
        "delivery semantics and has no faithful V1.52 wire projection.",
    );
  }

  const {
    callbackBusModel: _callbackBusModel,
    freezeBrokenAttackModel: _freezeBrokenAttackModel,
    ...configRest
  } = result.config;
  const config: SimConfigV152 = {
    ...configRest,
    schemaVersion: FREEZE_BROKEN_ATTACK_SCHEMA_VERSION,
    engineVersion: FREEZE_BROKEN_ATTACK_ENGINE_VERSION,
    freezeBrokenAttackModel: selectedFreezeBrokenModel,
  };
  const configHash = createSimulationConfigHash(config);

  const {
    callbackBusRoot: _callbackBusRoot,
    pluginCapabilities: _pluginCapabilities,
    pluginCallbackSubscriptions: _pluginCallbackSubscriptions,
    freezeBrokenAttackRoot: _freezeBrokenAttackRoot,
    reproducibilityKey: _currentReproducibilityKey,
    ...manifestRest
  } = result.runManifest;
  const manifestIdentity: Omit<
    SimulationRunManifestV152,
    "reproducibilityKey"
  > = {
    ...manifestRest,
    version: FREEZE_BROKEN_ATTACK_RUN_MANIFEST_VERSION,
    schemaVersion: FREEZE_BROKEN_ATTACK_SCHEMA_VERSION,
    engineVersion: FREEZE_BROKEN_ATTACK_ENGINE_VERSION,
    configHash,
    freezeBrokenAttackRoot: selectedFreezeBrokenRoot,
  };
  const runManifest: SimulationRunManifestV152 = {
    ...manifestIdentity,
    reproducibilityKey: createSimulationReproducibilityKey(manifestIdentity),
  };

  const {
    callbackRegistrationLog: _callbackRegistrationLog,
    callbackDeliveryLog: _callbackDeliveryLog,
    ...resultRest
  } = result;
  const projected = {
    ...resultRest,
    schemaVersion: FREEZE_BROKEN_ATTACK_SCHEMA_VERSION,
    engineVersion: FREEZE_BROKEN_ATTACK_ENGINE_VERSION,
    config,
    runManifest,
    reproducibilityKey: runManifest.reproducibilityKey,
  } as SimulationResultForV152;

  // Keep the original object's key order for byte-frozen historical Golden
  // serialization while making both frozen 1.52 boundaries authoritative.
  simulationResultV152Schema.parse(projected);
  assertTrustedSimulationResultV152(projected);
  return projected;
}
