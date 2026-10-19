import {
  ARTIFACT_BUFF_SOURCE,
  type ArtifactBuffActor,
  type ArtifactBuffApplication,
  type ArtifactBuffDecision,
  type ArtifactBuffEvent,
  type ArtifactBuffState,
} from "@genshin-dps-lab/reaction-formulas";

const source = ARTIFACT_BUFF_SOURCE;

/** Source presence checks include the expiry frame; real reads clear it separately. */
function isPresent(expiry: number | null, frame: number): boolean {
  return expiry !== null && frame <= expiry;
}

function acceptsEvent(actor: ArtifactBuffActor, event: ArtifactBuffEvent, state: ArtifactBuffState): boolean {
  switch (event.kind) {
    case "burst":
      return actor.effectId === "noblesse-4pc" || actor.effectId === "vermillion-4pc";
    case "reaction":
      return actor.effectId === "instructor-4pc" || actor.effectId === "gilded-4pc"
        || actor.effectId === "paradise-4pc" && (event.reaction === "bloom" || event.reaction === "hyperbloom" || event.reaction === "burgeon");
    case "bond-of-life-change":
      return actor.effectId === "fragment-4pc";
    case "hp-drain":
    case "swap":
      return actor.effectId === "vermillion-4pc";
    case "stats-sample":
    case "react-bonus-read":
      return actor.actorId === event.actorId
        && state.effectExpiresFrame !== null && state.effectExpiresFrame <= event.frame
        && (event.kind === "react-bonus-read" ? actor.effectId === "paradise-4pc" : actor.effectId !== "paradise-4pc");
    case "delayed-buff":
      return actor.actorId === event.task.actorId && actor.effectId === event.task.effectId;
  }
}

/**
 * Independently replay one fixed-source callback from an authenticated event.
 * The caller owns event provenance and ordering; neither imported decisions nor
 * runtime traces participate in this calculation. Inputs are never mutated.
 */
export function replayArtifactBuffDecision(
  actor: ArtifactBuffActor,
  event: ArtifactBuffEvent,
  stateBefore: ArtifactBuffState,
  partyIds: readonly string[],
  sameElementCount: number,
  differentElementCount: number,
): ArtifactBuffDecision | undefined {
  if (!acceptsEvent(actor, event, stateBefore)) return undefined;

  const stateAfter = { ...stateBefore };
  const decision: ArtifactBuffDecision = {
    sourceProfileId: source.id,
    sourceRef: source.sourceRefs[actor.effectId],
    actorId: actor.actorId,
    effectId: actor.effectId,
    event: structuredClone(event),
    outcome: "applied",
    stateBefore: { ...stateBefore },
    stateAfter,
    sameElementCount: actor.effectId === "gilded-4pc" ? Math.min(source.gilded.countCap, sameElementCount) : 0,
    differentElementCount: actor.effectId === "gilded-4pc" ? Math.min(source.gilded.countCap, differentElementCount) : 0,
    applications: [],
    removals: [],
    delayedApplications: [],
  };
  const apply = (
    receiverId: string,
    key: string,
    stat: ArtifactBuffApplication["stat"],
    value: number,
    expiresFrame: number,
    operation: ArtifactBuffApplication["operation"] = "replace",
  ): void => {
    decision.applications.push({
      receiverId, sourceActorId: actor.actorId, key, stat, operation, value,
      startFrame: event.frame, expiresFrame,
    });
  };

  switch (event.kind) {
    case "burst": {
      // The source OnBurst hook gates on the active character, not a damage actor.
      if (event.activeCharacterId !== actor.actorId) {
        decision.outcome = "off-field";
        break;
      }
      if (actor.effectId === "noblesse-4pc") {
        for (const receiverId of partyIds) {
          if (receiverId === actor.actorId && actor.noblesseSelfDelayFrames === 1) {
            decision.delayedApplications.push({
              actorId: actor.actorId, effectId: "noblesse-4pc", receiverId,
              applyFrame: event.frame + 1, sourceFrame: event.frame,
            });
          } else {
            apply(receiverId, source.noblesse.key, "atkPct", source.noblesse.atkPct, event.frame + source.noblesse.durationFrames);
          }
        }
        if (decision.delayedApplications.length > 0) decision.outcome = "scheduled";
      } else {
        stateAfter.stacks = 0;
        stateAfter.effectExpiresFrame = event.frame + source.vermillion.durationFrames;
        apply(actor.actorId, source.vermillion.key, "atkPct", source.vermillion.baseAtkPct, stateAfter.effectExpiresFrame);
      }
      break;
    }
    case "reaction": {
      // Instructor rejects off-field first, even when the reaction has another owner.
      if (actor.effectId === "instructor-4pc" && event.activeCharacterId !== actor.actorId) {
        decision.outcome = "off-field";
      } else if (event.sourceActorId !== actor.actorId) {
        decision.outcome = "wrong-owner";
      } else if (actor.effectId === "instructor-4pc") {
        for (const receiverId of partyIds) {
          apply(receiverId, source.instructor.key, "em", source.instructor.em, event.frame + source.instructor.durationFrames);
        }
      } else if (actor.effectId === "paradise-4pc" && event.reaction === "bloom" && !event.targetIsEnemy) {
        decision.outcome = "target-not-enemy";
      } else if (isPresent(stateBefore.cooldownExpiresFrame, event.frame)) {
        decision.outcome = "cooldown-blocked";
      } else if (actor.effectId === "gilded-4pc") {
        stateAfter.cooldownExpiresFrame = event.frame + source.gilded.cooldownFrames;
        stateAfter.effectExpiresFrame = event.frame + source.gilded.durationFrames;
        apply(actor.actorId, source.gilded.key, "atkPct", decision.sameElementCount * source.gilded.atkPctPerSameElement, stateAfter.effectExpiresFrame);
        apply(actor.actorId, source.gilded.key, "em", decision.differentElementCount * source.gilded.emPerDifferentElement, stateAfter.effectExpiresFrame);
      } else {
        const previousStacks = isPresent(stateBefore.effectExpiresFrame, event.frame) ? stateBefore.stacks : 0;
        stateAfter.stacks = Math.min(source.paradise.stackCap, previousStacks + 1);
        stateAfter.cooldownExpiresFrame = event.frame + source.paradise.cooldownFrames;
        stateAfter.effectExpiresFrame = event.frame + source.paradise.durationFrames;
        decision.outcome = "stack-gained";
        // Paradise is consumed through ReactBonus, so it writes no ordinary stat application.
      }
      break;
    }
    case "bond-of-life-change": {
      if (event.actorId !== actor.actorId) {
        decision.outcome = "wrong-owner";
      } else if (event.amount === 0) {
        decision.outcome = "zero-change";
      } else {
        const previousStacks = isPresent(stateBefore.effectExpiresFrame, event.frame) ? stateBefore.stacks : 0;
        stateAfter.stacks = Math.min(source.fragment.stackCap, previousStacks + 1);
        stateAfter.effectExpiresFrame = event.frame + source.fragment.durationFrames;
        decision.outcome = "stack-gained";
        apply(actor.actorId, source.fragment.key, "dmgBonus", stateAfter.stacks * source.fragment.dmgBonusPerStack, stateAfter.effectExpiresFrame);
      }
      break;
    }
    case "hp-drain": {
      const expiry = stateBefore.effectExpiresFrame;
      if (event.amount <= 0) {
        decision.outcome = "zero-change";
      } else if (expiry === null || !isPresent(expiry, event.frame)) {
        decision.outcome = "window-inactive";
      } else if (isPresent(stateBefore.cooldownExpiresFrame, event.frame)) {
        decision.outcome = "cooldown-blocked";
      } else if (stateBefore.stacks === source.vermillion.stackCap) {
        decision.outcome = "max-stacks";
      } else {
        stateAfter.stacks = Math.min(source.vermillion.stackCap, stateBefore.stacks + 1);
        stateAfter.cooldownExpiresFrame = event.frame + source.vermillion.cooldownFrames;
        decision.outcome = "stack-gained";
        // Update the existing modifier value; its original burst window survives.
        apply(actor.actorId, source.vermillion.key, "atkPct",
          source.vermillion.baseAtkPct + stateAfter.stacks * source.vermillion.atkPctPerStack,
          expiry, "update");
      }
      break;
    }
    case "swap":
      stateAfter.stacks = 0;
      stateAfter.effectExpiresFrame = null;
      decision.outcome = "window-removed";
      decision.removals.push({ receiverId: actor.actorId, key: source.vermillion.key });
      break;
    case "stats-sample":
    case "react-bonus-read":
      // Eligibility already proves a real matching read at or after expiry.
      // Source private stacks and the separate ICD are not cleared by this read.
      stateAfter.effectExpiresFrame = null;
      decision.outcome = "expired-on-read";
      break;
    case "delayed-buff":
      apply(event.task.receiverId, source.noblesse.key, "atkPct", source.noblesse.atkPct,
        event.frame + source.noblesse.durationFrames);
      break;
  }

  return decision;
}
