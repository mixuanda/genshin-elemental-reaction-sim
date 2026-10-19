import type { RefinementCtx } from "zod";
import { MOONLIGHT_ARTIFACT_BONUS_SOURCES } from "@genshin-dps-lab/reaction-formulas";
import type { SimulationResult } from "./types";

type Point = { frame: number; priority?: number; eventSequence?: number; parentDamageEventId?: number; artifactStage?: "before-reaction" | "after-reaction" };
const elementals = new Set(["pyro", "hydro", "electro", "cryo", "anemo", "geo", "dendro"]);

/** Replays the last application of each source key, never a reported stat snapshot. */
export function moonlightStatBonusAt(result: SimulationResult, actorId: string, stat: "em" | "critRate", point: Point): number {
  if (result.config.moonlightArtifactModel === undefined) return 0;
  const current = new Map<string, { value: number; expiresAtFrame: number }>();
  for (const row of result.moonlightArtifactLog ?? []) {
    if (row.frame > point.frame) break;
    if (row.frame === point.frame) {
      const trigger = row.triggerDamageEventId === undefined ? undefined : result.damageEvents[row.triggerDamageEventId];
      // OnEnemyDamage runs after its own reaction/stat snapshot. A Lunar
      // conversion callback runs during the hit, after its direct snapshot.
      if (trigger === undefined) continue;
      if (point.parentDamageEventId === trigger.id || point.eventSequence === trigger.eventSequence && point.priority === trigger.eventPriority) {
        if (row.event === "OnEnemyDamage" || point.artifactStage !== "after-reaction") continue;
      } else if (point.priority !== undefined && (trigger.eventPriority > point.priority || trigger.eventPriority === point.priority && (point.eventSequence === undefined || trigger.eventSequence >= point.eventSequence))) continue;
    }
    for (const application of row.applications) if (application.receiverActorId === actorId && application.stat === stat)
      current.set(application.key, { value: application.value, expiresAtFrame: application.expiresAtFrame });
  }
  return [...current.values()].reduce((sum, application) => sum + (application.expiresAtFrame > point.frame ? application.value : 0), 0);
}

/** Validate the callback ledger's fixed source parameters and ordinary event links. */
export function validateMoonlightArtifactIntegrity(result: SimulationResult, context: RefinementCtx): void {
  const model = result.config.moonlightArtifactModel;
  const log = result.moonlightArtifactLog;
  if (model === undefined) {
    if (log !== undefined) context.addIssue({ code: "custom", path: ["moonlightArtifactLog"], message: "Moonlight callback ledger requires its saved model" });
    return;
  }
  if (log === undefined) {
    context.addIssue({ code: "custom", path: ["moonlightArtifactLog"], message: "Moonlight model requires its callback ledger" });
    return;
  }
  const ids = result.config.characters.map(actor => actor.id);
  const lastByReceiver = new Map<string, { sourceActorId: string; expiresAtFrame: number }>();
  let previousFrame = -1;
  for (const [index, row] of log.entries()) {
    const path = ["moonlightArtifactLog", index];
    if (row.id !== index || row.frame < previousFrame) context.addIssue({ code: "custom", path, message: "Moonlight callback IDs and frames must follow execution order" });
    previousFrame = row.frame;
    const holder = model.actors.find(actor => actor.actorId === row.wearerActorId);
    if (holder?.setId !== row.setId) context.addIssue({ code: "custom", path: [...path, "wearerActorId"], message: "callback wearer must equip the recorded set" });
    const night = row.setId === "artifact-set:15041";
    const expectedSource = night ? MOONLIGHT_ARTIFACT_BONUS_SOURCES.night : MOONLIGHT_ARTIFACT_BONUS_SOURCES.silken;
    if (row.sourceRef !== expectedSource) context.addIssue({ code: "custom", path: [...path, "sourceRef"], message: "Moonlight callback source mismatch" });
    if (night !== (row.event !== "OnEnemyDamage") || !night && (model.moonsignLevel === 0 || row.triggerActorId !== row.wearerActorId))
      context.addIssue({ code: "custom", path: [...path, "event"], message: "Moonlight callback does not match set and Moon Sign" });
    const trigger = row.triggerDamageEventId === undefined ? undefined : result.damageEvents[row.triggerDamageEventId];
    if (row.triggerDamageEventId !== undefined && (trigger === undefined || trigger.id !== row.triggerDamageEventId || trigger.frame !== row.frame || trigger.sourceActorId !== row.triggerActorId))
      context.addIssue({ code: "custom", path: [...path, "triggerDamageEventId"], message: "callback must link its actual ordinary damage event" });
    if (night) {
      if (row.triggerDamageEventId === undefined || trigger?.activeCharacterId !== row.wearerActorId)
        context.addIssue({ code: "custom", path: [...path, "triggerDamageEventId"], message: "Night needs an actual front wearer and Lunar conversion" });
      const reaction = row.event === "OnLunarCharged" ? "lunarCharged" : row.event === "OnLunarCrystallize" ? "lunarCrystallize" : "lunarBloom";
      if (reaction !== "lunarBloom" && !trigger?.reactionAudit.specialReactions?.includes(reaction) || reaction === "lunarBloom" && !trigger?.reactionAudit.bloomReactions.some(entry => entry.reaction === "bloom") && !result.reactionTaskLog.some(task => task.kind === "quicken-bloom-followup" && task.frame === row.frame && task.status === "triggered"))
        context.addIssue({ code: "custom", path: [...path, "event"], message: "Night requires a recorded Lunar conversion" });
      const application = row.applications[0], value = model.moonsignLevel === 0 ? 0 : model.moonsignLevel === 1 ? 0.15 : 0.3;
      if (row.applications.length !== 1 || application?.receiverActorId !== row.wearerActorId || application.key !== "gleaming-moon-intent-cr" || application.stat !== "critRate" || application.value !== value || application.expiresAtFrame !== row.frame + 240)
        context.addIssue({ code: "custom", path: [...path, "applications"], message: "Night CR application must use the fixed Moon Sign value and 240-frame window" });
    } else {
      if (trigger !== undefined && !elementals.has(trigger.element)) context.addIssue({ code: "custom", path: [...path, "triggerDamageEventId"], message: "Silken ordinary trigger requires actual non-physical elemental enemy damage" });
      const value = model.moonsignLevel === 1 ? 60 : 120;
      if (row.applications.length !== ids.length || new Set(row.applications.map(app => app.receiverActorId)).size !== ids.length) context.addIssue({ code: "custom", path: [...path, "applications"], message: "Silken must apply one shared key to every party member" });
      for (const [appIndex, application] of row.applications.entries()) {
        const previous = lastByReceiver.get(application.receiverActorId);
        const replaced = previous !== undefined && previous.expiresAtFrame > row.frame ? previous.sourceActorId : null;
        if (!ids.includes(application.receiverActorId) || application.key !== "gleaming-moon-devotion-em" || application.stat !== "em" || application.value !== value || application.expiresAtFrame !== row.frame + 480 || application.replacedSourceActorId !== replaced)
          context.addIssue({ code: "custom", path: [...path, "applications", appIndex], message: "Silken EM application must follow fixed value, expiry and same-key overwrite" });
        lastByReceiver.set(application.receiverActorId, { sourceActorId: row.wearerActorId, expiresAtFrame: application.expiresAtFrame });
      }
    }
  }
}
