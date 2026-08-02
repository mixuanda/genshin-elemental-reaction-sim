import {
  REACTION_OWNED_RESET_BOUNDARY_ENGINE_VERSION,
  REACTION_OWNED_RESET_BOUNDARY_RUN_MANIFEST_VERSION,
  REACTION_OWNED_RESET_BOUNDARY_SCHEMA_VERSION,
  createSimulationConfigHash,
  createSimulationReproducibilityKey,
  simulationResultV149Schema,
  type ReactionDamageGroupAuditV149,
  type ReactionDamageGroupDecisionAuditV150,
  type SimConfigV149,
  type SimulationResultForV149,
  type SimulationResultForV150,
  type SimulationRunManifestV149,
} from "@genshin-dps-lab/schemas";

function projectReactionDamageGroupDecisionV150ToV149(
  decision: ReactionDamageGroupDecisionAuditV150,
): ReactionDamageGroupAuditV149 {
  if (decision.icdGroup === "reaction-a") {
    return {
      reaction: decision.reaction,
      sourceActorId: decision.sourceActorId,
      targetId: decision.targetId,
      windowStartFrame: decision.windowStartFrame,
      hitIndex: decision.hitIndex,
      resetFrames: 30,
      sequence: [true, true, false],
      damageAllowed: decision.damageAllowed,
      blockedReason: decision.blockedReason,
    };
  }

  return {
    reaction: decision.reaction,
    sourceActorId: decision.sourceActorId,
    targetId: decision.targetId,
    windowStartFrame: decision.windowStartFrame,
    hitIndex: decision.hitIndex,
    resetFrames: 30,
    sequence: [true, false],
    damageAllowed: decision.damageAllowed,
    blockedReason: decision.blockedReason,
  };
}

/**
 * Projects a current 1.50 run onto the exact frozen 1.49 public wire.
 *
 * The lazy-window V1 policy is representable exactly after rebuilding the
 * frozen compact ReactionA/B decision rows. The scheduled-reset V2 policy is
 * intentionally fail-closed whenever it produced an enemy/player decision or
 * reset-task row: those task-order semantics do not exist on the 1.49 wire.
 * An otherwise empty V2 run may discard only its unused policy identity.
 */
export function projectSimulationResultV150ToV149(
  result: SimulationResultForV150,
): SimulationResultForV149 {
  const enemyDecisions = result.reactionDamageLog.flatMap(
    (entry) => entry.damageGroupDecisions,
  );
  const playerDecisions = result.playerDamageEvents.flatMap((event) =>
    event.damageFactors.damageGroupDecision === null
      ? []
      : [event.damageFactors.damageGroupDecision],
  );
  const decisionCount = enemyDecisions.length + playerDecisions.length;
  const selectedModel = result.config.reactionDamageGroupModel;

  if (
    selectedModel.mode ===
      "fixed-gcsim-reaction-damage-task-order-v2" &&
    (decisionCount > 0 || result.reactionDamageGroupResetLog.length > 0)
  ) {
    throw new Error(
      "V1.50 to V1.49 compatibility projection supports V2 only for runs " +
        "without enemy/player reaction damage-group decisions or reset-task " +
        `rows; found ${decisionCount} decision(s) and ` +
        `${result.reactionDamageGroupResetLog.length} reset row(s), which ` +
        "have no faithful V1.49 wire projection.",
    );
  }
  if (
    selectedModel.mode === "legacy-reaction-damage-group-window-v1" &&
    result.reactionDamageGroupResetLog.length > 0
  ) {
    throw new Error(
      "V1.50 V1 lazy-window results cannot contain scheduled reaction " +
        "damage-group reset rows.",
    );
  }

  for (const decision of [...enemyDecisions, ...playerDecisions]) {
    if (decision.policyId !== selectedModel.policyId) {
      throw new Error(
        "V1.50 reaction damage-group decision policy does not match the " +
          "policy selected by config.",
      );
    }
  }

  const {
    reactionDamageGroupModel: _reactionDamageGroupModel,
    ...configRest
  } = result.config;
  const config: SimConfigV149 = {
    ...configRest,
    schemaVersion: REACTION_OWNED_RESET_BOUNDARY_SCHEMA_VERSION,
    engineVersion: REACTION_OWNED_RESET_BOUNDARY_ENGINE_VERSION,
  };
  const configHash = createSimulationConfigHash(config);

  const {
    reactionDamageGroupRoot: _reactionDamageGroupRoot,
    reproducibilityKey: _currentReproducibilityKey,
    ...manifestRest
  } = result.runManifest;
  const manifestIdentity: Omit<
    SimulationRunManifestV149,
    "reproducibilityKey"
  > = {
    ...manifestRest,
    version: REACTION_OWNED_RESET_BOUNDARY_RUN_MANIFEST_VERSION,
    schemaVersion: REACTION_OWNED_RESET_BOUNDARY_SCHEMA_VERSION,
    engineVersion: REACTION_OWNED_RESET_BOUNDARY_ENGINE_VERSION,
    configHash,
  };
  const runManifest: SimulationRunManifestV149 = {
    ...manifestIdentity,
    reproducibilityKey:
      createSimulationReproducibilityKey(manifestIdentity),
  };

  const reactionDamageLog = result.reactionDamageLog.map((entry) => ({
    ...entry,
    damageGroupDecisions: entry.damageGroupDecisions.map(
      projectReactionDamageGroupDecisionV150ToV149,
    ),
  }));
  const playerDamageEvents = result.playerDamageEvents.map((event) => ({
    ...event,
    damageFactors: {
      ...event.damageFactors,
      damageGroupDecision:
        event.damageFactors.damageGroupDecision === null
          ? null
          : projectReactionDamageGroupDecisionV150ToV149(
              event.damageFactors.damageGroupDecision,
            ),
    },
  }));
  const {
    reactionDamageGroupResetLog: _reactionDamageGroupResetLog,
    ...resultRest
  } = result;
  const projected = {
    ...resultRest,
    schemaVersion: REACTION_OWNED_RESET_BOUNDARY_SCHEMA_VERSION,
    engineVersion: REACTION_OWNED_RESET_BOUNDARY_ENGINE_VERSION,
    config,
    runManifest,
    reproducibilityKey: runManifest.reproducibilityKey,
    reactionDamageLog,
    playerDamageEvents,
  } as SimulationResultForV149;

  // Validate the exact frozen public wire while retaining authored property
  // order for byte-stable historical compatibility projections.
  simulationResultV149Schema.parse(projected);
  return projected;
}
