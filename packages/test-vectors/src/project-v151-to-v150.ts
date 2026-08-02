import {
  REACTION_DAMAGE_GROUP_RESET_BOUNDARY_ENGINE_VERSION,
  REACTION_DAMAGE_GROUP_RESET_BOUNDARY_RUN_MANIFEST_VERSION,
  REACTION_DAMAGE_GROUP_RESET_BOUNDARY_SCHEMA_VERSION,
  createSimulationConfigHash,
  createSimulationReproducibilityKey,
  simulationResultV150Schema,
  simulationResultV151Schema,
  type SimConfigV150,
  type SimulationResultForV150,
  type SimulationResultForV151,
  type SimulationRunManifestV150,
  type TargetStateTimelineLinkV150,
  type TargetStateTimelinePointV150,
  type TargetStateTimelineV150,
} from "@genshin-dps-lab/schemas";

function projectTargetStateTimelineV151ToV150(
  result: SimulationResultForV151,
  stripLegacySchedulerLinks: boolean,
): TargetStateTimelineV150 {
  const points = result.targetStateTimeline.points.map((point) => {
    if (point.eventType === "reactionAuraAttachment") {
      throw new Error(
        `V1.51 target-state point ${point.id} uses the 1.51-only ` +
          '"reactionAuraAttachment" event and has no faithful V1.50 wire projection.',
      );
    }
    if (point.cause === "reaction-aura-attachment") {
      throw new Error(
        `V1.51 target-state point ${point.id} uses the 1.51-only ` +
          '"reaction-aura-attachment" cause and has no faithful V1.50 wire projection.',
      );
    }
    if (
      point.links.some(
        (link) => link.kind === "basic-reaction-scheduler-log",
      ) &&
      !stripLegacySchedulerLinks
    ) {
      throw new Error(
        `V1.51 target-state point ${point.id} contains a 1.51-only ` +
          "basic-reaction-scheduler-log link and has no faithful V1.50 wire projection.",
      );
    }
    const links = point.links.filter(
      (link): link is TargetStateTimelineLinkV150 =>
        link.kind !== "basic-reaction-scheduler-log",
    );
    return {
      ...point,
      eventType: point.eventType,
      cause: point.cause,
      links,
    } satisfies TargetStateTimelinePointV150;
  });
  return {
    version: result.targetStateTimeline.version,
    points,
  };
}

/**
 * Projects a current 1.51 result onto the exact frozen 1.50 public wire.
 *
 * Scheduler V1 preserves the 1.50 immediate-attachment mechanics, so its
 * standalone scheduler audit and its reciprocal timeline links can be
 * removed, provided no deferred-attachment event/cause exists. Scheduler V2
 * is only representable when it was completely inactive: any scheduler row
 * or 1.51-only timeline fact may encode deferred same-frame attachment
 * ordering that the frozen 1.50 wire cannot express and therefore fails
 * closed.
 */
export function projectSimulationResultV151ToV150(
  result: SimulationResultForV151,
): SimulationResultForV150 {
  // Projection deliberately removes the 1.51-only scheduler proof, so the
  // source wire must pass the complete public 1.51 boundary before any root,
  // log, or reciprocal timeline link can be discarded. Keep projecting the
  // original object below to preserve authored property order.
  simulationResultV151Schema.parse(result);

  const selectedModel = result.config.basicReactionSchedulerModel;
  const selectedRoot = result.runManifest.basicReactionSchedulerRoot;
  if (selectedRoot.policyId !== selectedModel.policyId) {
    throw new Error(
      "V1.51 basic-reaction scheduler root policy does not match the " +
        "policy selected by config.",
    );
  }

  if (
    selectedModel.mode === "fixed-gcsim-basic-reaction-scheduler-v2" &&
    result.basicReactionSchedulerLog.length > 0
  ) {
    throw new Error(
      "V1.51 to V1.50 compatibility projection supports scheduler V2 " +
        "only when basicReactionSchedulerLog is empty; deferred scheduler " +
        `semantics produced ${result.basicReactionSchedulerLog.length} row(s).`,
    );
  }
  if (
    selectedModel.mode === "legacy-immediate-basic-reaction-scheduler-v1"
  ) {
    const incompatibleRow = result.basicReactionSchedulerLog.find(
      (entry) =>
        entry.kind !== "swirl-attack-resolution" ||
        entry.disposition !== "legacy-immediate" ||
        entry.pairedLogId !== null,
    );
    if (incompatibleRow !== undefined) {
      throw new Error(
        `V1.51 scheduler V1 log row ${incompatibleRow.id} is not a ` +
          "standalone legacy-immediate attack audit and cannot be discarded.",
      );
    }
  }

  const targetStateTimeline = projectTargetStateTimelineV151ToV150(
    result,
    selectedModel.mode ===
      "legacy-immediate-basic-reaction-scheduler-v1",
  );

  const {
    basicReactionSchedulerModel: _basicReactionSchedulerModel,
    ...configRest
  } = result.config;
  const config: SimConfigV150 = {
    ...configRest,
    schemaVersion: REACTION_DAMAGE_GROUP_RESET_BOUNDARY_SCHEMA_VERSION,
    engineVersion: REACTION_DAMAGE_GROUP_RESET_BOUNDARY_ENGINE_VERSION,
  };
  const configHash = createSimulationConfigHash(config);

  const {
    basicReactionSchedulerRoot: _basicReactionSchedulerRoot,
    reproducibilityKey: _currentReproducibilityKey,
    ...manifestRest
  } = result.runManifest;
  const manifestIdentity: Omit<
    SimulationRunManifestV150,
    "reproducibilityKey"
  > = {
    ...manifestRest,
    version: REACTION_DAMAGE_GROUP_RESET_BOUNDARY_RUN_MANIFEST_VERSION,
    schemaVersion: REACTION_DAMAGE_GROUP_RESET_BOUNDARY_SCHEMA_VERSION,
    engineVersion: REACTION_DAMAGE_GROUP_RESET_BOUNDARY_ENGINE_VERSION,
    configHash,
  };
  const runManifest: SimulationRunManifestV150 = {
    ...manifestIdentity,
    reproducibilityKey:
      createSimulationReproducibilityKey(manifestIdentity),
  };

  const {
    basicReactionSchedulerLog: _basicReactionSchedulerLog,
    ...resultRest
  } = result;
  const projected = {
    ...resultRest,
    schemaVersion: REACTION_DAMAGE_GROUP_RESET_BOUNDARY_SCHEMA_VERSION,
    engineVersion: REACTION_DAMAGE_GROUP_RESET_BOUNDARY_ENGINE_VERSION,
    config,
    runManifest,
    reproducibilityKey: runManifest.reproducibilityKey,
    targetStateTimeline,
  } as SimulationResultForV150;

  // The exact frozen schema is the final authority for every nested 1.50
  // envelope, including the absence of scheduler-only timeline literals.
  simulationResultV150Schema.parse(projected);
  return projected;
}
