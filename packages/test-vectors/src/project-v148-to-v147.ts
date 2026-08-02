import {
  ELEMENTAL_APPLICATION_ICD_ROOT_ENGINE_VERSION,
  ELEMENTAL_APPLICATION_ICD_ROOT_SCHEMA_VERSION,
  ELEMENTAL_APPLICATION_ICD_RUN_MANIFEST_VERSION,
  createSimulationConfigHash,
  createSimulationReproducibilityKey,
  simulationResultV147Schema,
  type SimConfigV147,
  type SimulationResult,
  type SimulationResultForV147,
  type SimulationRunManifestV147,
  type TargetPhaseV3LogEntryV147
} from "@genshin-dps-lab/schemas";

/**
 * Projects only runs with no reaction-owned application rows. Trusted Burning
 * and Swirl rows have no faithful 1.47 wire representation, so this helper
 * fails closed instead of inventing a legacy reaction audit. Historical
 * Golden bytes remain the authority; this helper exists so current-engine
 * compatibility tests do not accidentally reinterpret CURRENT as 1.47.
 */
export function projectSimulationResultV148ToV147(
  result: SimulationResult
): SimulationResultForV147 {
  const reactionOwnedApplications =
    result.elementalApplicationIcdLog.filter(
      (entry) => entry.sourceKind !== "configured-direct-hit"
    );
  if (reactionOwnedApplications.length > 0) {
    const sourceKinds = [
      ...new Set(
        reactionOwnedApplications.map((entry) => entry.sourceKind)
      )
    ].join(", ");
    throw new Error(
      "V1.48 to V1.47 compatibility projection supports only runs " +
        "without reaction-owned elemental-application rows; trusted " +
        `reaction sources (${sourceKinds}) have no faithful V1.47 wire projection.`
    );
  }

  const {
    reactionOwnedElementalApplicationModel: _reactionOwnedModel,
    ...configRest
  } = result.config;
  const config: SimConfigV147 = {
    ...configRest,
    schemaVersion: ELEMENTAL_APPLICATION_ICD_ROOT_SCHEMA_VERSION,
    engineVersion: ELEMENTAL_APPLICATION_ICD_ROOT_ENGINE_VERSION
  };
  const configHash = createSimulationConfigHash(config);

  const {
    reactionOwnedElementalApplicationRoot: _reactionOwnedRoot,
    reproducibilityKey: _currentReproducibilityKey,
    ...manifestRest
  } = result.runManifest;
  const manifestIdentity: Omit<
    SimulationRunManifestV147,
    "reproducibilityKey"
  > = {
    ...manifestRest,
    version: ELEMENTAL_APPLICATION_ICD_RUN_MANIFEST_VERSION,
    schemaVersion: ELEMENTAL_APPLICATION_ICD_ROOT_SCHEMA_VERSION,
    engineVersion: ELEMENTAL_APPLICATION_ICD_ROOT_ENGINE_VERSION,
    configHash
  };
  const runManifest: SimulationRunManifestV147 = {
    ...manifestIdentity,
    reproducibilityKey:
      createSimulationReproducibilityKey(manifestIdentity)
  };

  const directApplications =
    result.elementalApplicationIcdLog.filter(
      (entry) => entry.sourceKind === "configured-direct-hit"
    );
  const directApplicationId = new Map(
    directApplications.map((entry, index) => [entry.id, index])
  );
  const elementalApplicationIcdLog = directApplications.map(
    (entry, id) => ({ ...entry, id })
  );

  const stripDamageEvent = (
    event: SimulationResult["damageEvents"][number]
  ) => {
    const {
      elementalApplicationIcdLogId: _applicationLogId,
      ...v147
    } = event;
    return v147;
  };
  const stripHitResolution = (
    entry: SimulationResult["hitResolutionLog"][number]
  ) => {
    const {
      reactionDamageLogId: _reactionDamageLogId,
      elementalApplicationIcdLogId: _applicationLogId,
      ...v147
    } = entry;
    return v147;
  };
  const stripReactionDamage = (
    entry: SimulationResult["reactionDamageLog"][number]
  ) => {
    const {
      hitResolutionLogIds: _hitResolutionLogIds,
      elementalApplicationIcdLogIds: _applicationLogIds,
      ...v147
    } = entry;
    return v147;
  };
  const stripTargetPhase = (
    phase: SimulationResult["targetPhaseLog"][number]
  ) => {
    if (phase.model !== "target-phase-v3") return phase;
    return {
      ...phase,
      targetTasks: phase.targetTasks.map((task) => ({
        ...task,
        delivery:
          task.delivery === null
            ? null
            : {
                ...task.delivery,
                attempts: task.delivery.attempts.map((attempt) => {
                  const {
                    elementalApplicationIcdLogId:
                      _applicationLogId,
                    ...v147
                  } = attempt;
                  return v147;
                })
              }
      }))
    } satisfies TargetPhaseV3LogEntryV147;
  };

  // A direct row's id is stable in current ordinary-hit-only vectors. The
  // remap makes the projection correct even when reaction rows were interleaved.
  for (const entry of directApplications) {
    if (directApplicationId.get(entry.id) === undefined) {
      throw new Error(
        `Missing projected direct application id for ${entry.id}.`
      );
    }
  }

  return simulationResultV147Schema.parse({
    ...result,
    schemaVersion: ELEMENTAL_APPLICATION_ICD_ROOT_SCHEMA_VERSION,
    engineVersion: ELEMENTAL_APPLICATION_ICD_ROOT_ENGINE_VERSION,
    config,
    runManifest,
    reproducibilityKey: runManifest.reproducibilityKey,
    damageEvents: result.damageEvents.map(stripDamageEvent),
    hitEvents: result.hitEvents.map(stripDamageEvent),
    elementalApplicationIcdLog,
    hitResolutionLog:
      result.hitResolutionLog.map(stripHitResolution),
    reactionDamageLog:
      result.reactionDamageLog.map(stripReactionDamage),
    targetPhaseLog: result.targetPhaseLog.map(stripTargetPhase)
  }) as SimulationResultForV147;
}
