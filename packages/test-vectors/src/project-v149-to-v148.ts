import {
  GCSIM_REACTION_OWNED_APPLICATION_POLICY_V1_ID,
  GCSIM_REACTION_OWNED_APPLICATION_POLICY_V1_ROOT,
} from "@genshin-dps-lab/icd-profiles";
import {
  REACTION_OWNED_APPLICATION_ROOT_ENGINE_VERSION,
  REACTION_OWNED_APPLICATION_ROOT_SCHEMA_VERSION,
  REACTION_OWNED_APPLICATION_RUN_MANIFEST_VERSION,
  createSimulationConfigHash,
  createSimulationReproducibilityKey,
  simulationResultV148Schema,
  type SimConfigV148,
  type SimulationResultForV148,
  type SimulationResultForV149,
  type SimulationRunManifestV148,
} from "@genshin-dps-lab/schemas";

/**
 * Projects a current 1.49 run onto the exact frozen 1.48 public wire.
 *
 * The projection is intentionally closed to V2 runs that contain
 * reaction-owned application rows. V2 Burning decisions have different
 * reset-boundary semantics and cannot be represented faithfully by the frozen
 * V1.48 wire. Migrated V1 runs remain wire-compatible, while the default
 * 120-second V2 compatibility preset has no Burning or Swirl propagation rows;
 * replacing only that empty run's selected policy identity is lossless.
 */
export function projectSimulationResultV149ToV148(
  result: SimulationResultForV149,
): SimulationResultForV148 {
  const reactionOwnedApplications =
    result.elementalApplicationIcdLog.filter(
      (entry) => entry.sourceKind !== "configured-direct-hit",
    );
  if (
    reactionOwnedApplications.length > 0 &&
    result.config.reactionOwnedElementalApplicationModel.mode !==
      "fixed-gcsim-reaction-owned-application-v1"
  ) {
    const sourceKinds = [
      ...new Set(
        reactionOwnedApplications.map((entry) => entry.sourceKind),
      ),
    ].join(", ");
    throw new Error(
      "V1.49 to V1.48 compatibility projection supports only runs " +
        "without V2 reaction-owned elemental-application rows; V2 " +
        `reaction sources (${sourceKinds}) have no faithful V1.48 wire projection.`,
    );
  }

  const {
    reactionOwnedElementalApplicationModel: _currentReactionOwnedModel,
    ...configRest
  } = result.config;
  const config: SimConfigV148 = {
    ...configRest,
    schemaVersion: REACTION_OWNED_APPLICATION_ROOT_SCHEMA_VERSION,
    engineVersion: REACTION_OWNED_APPLICATION_ROOT_ENGINE_VERSION,
    reactionOwnedElementalApplicationModel: {
      mode: "fixed-gcsim-reaction-owned-application-v1",
      policyId: GCSIM_REACTION_OWNED_APPLICATION_POLICY_V1_ID,
    },
  };
  const configHash = createSimulationConfigHash(config);

  const {
    reactionOwnedElementalApplicationRoot: _currentReactionOwnedRoot,
    reproducibilityKey: _currentReproducibilityKey,
    ...manifestRest
  } = result.runManifest;
  const manifestIdentity: Omit<
    SimulationRunManifestV148,
    "reproducibilityKey"
  > = {
    ...manifestRest,
    version: REACTION_OWNED_APPLICATION_RUN_MANIFEST_VERSION,
    schemaVersion: REACTION_OWNED_APPLICATION_ROOT_SCHEMA_VERSION,
    engineVersion: REACTION_OWNED_APPLICATION_ROOT_ENGINE_VERSION,
    configHash,
    reactionOwnedElementalApplicationRoot:
      GCSIM_REACTION_OWNED_APPLICATION_POLICY_V1_ROOT,
  };
  const runManifest: SimulationRunManifestV148 = {
    ...manifestIdentity,
    reproducibilityKey:
      createSimulationReproducibilityKey(manifestIdentity),
  };

  const projected = {
    ...result,
    schemaVersion: REACTION_OWNED_APPLICATION_ROOT_SCHEMA_VERSION,
    engineVersion: REACTION_OWNED_APPLICATION_ROOT_ENGINE_VERSION,
    config,
    runManifest,
    reproducibilityKey: runManifest.reproducibilityKey,
  } as SimulationResultForV148;

  // Validate against the exact frozen public wire without returning Zod's
  // descriptor-cleaned clone. Historical Golden bytes also freeze authored
  // property order, and the lossless projection must not reorder compatible
  // V1 reaction rows merely as a side effect of validation.
  simulationResultV148Schema.parse(projected);
  return projected;
}
