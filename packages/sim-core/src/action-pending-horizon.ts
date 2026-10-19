import { getWeaponProcDefinition } from "@genshin-dps-lab/reaction-formulas";
import type { ActionDefinition, AbilityDefinition, HitDefinition, PeriodicEntityDefinition, WeaponProcModel } from "@genshin-dps-lab/schemas";

/**
 * PeriodicEntityRuntime executes the first tick at or beyond expiry, then stops.
 * Replacement may cancel an earlier queued tick, but cannot extend this bound.
 * Periodic hit templates have zero offset by schema; their delay is declared here.
 */
function periodicLastHitFrame(entity: PeriodicEntityDefinition): number {
  const lastTickIndex = Math.max(0, Math.ceil((entity.durationFrames - entity.firstTickDelayFrames) / entity.intervalFrames));
  return entity.spawnFrame + entity.firstTickDelayFrames + lastTickIndex * entity.intervalFrames + entity.hitDelayFrames;
}

function weaponProcPendingHorizonTicks(
  actorId: string,
  hits: readonly (Pick<HitDefinition, "id" | "attackTag"> & { frame: number })[],
  entities: readonly PeriodicEntityDefinition[],
  model?: WeaponProcModel,
): number {
  const actor = model?.actors.find(candidate => candidate.actorId === actorId);
  if (actor === undefined) return 0;
  const definition = getWeaponProcDefinition(actor.weaponId)!;
  if (actor.weaponId === "swordofnarzissenkreuz" && actor.hasInnateArkhe === true) return 0;
  const lastDeliveryOffset = actor.weaponId === "eyeofperception" ? 50 : definition.damageOffsetsFrames?.at(-1) ?? definition.damageDelayFrames;
  const eligibleHits = hits.filter(hit => definition.triggerAttackTags === null ||
    definition.triggerAttackTags.some(tag => tag === hit.attackTag));
  const eligibleIds = new Set(eligibleHits.flatMap(hit => hit.id === undefined ? [] : [hit.id]));
  const periodicHitIds = new Set(entities.flatMap(entity => entity.hitIds));
  // A proc's cooldown is live state, not a queued task. Only its damage delay
  // extends the horizon; on-field/conditional checks may suppress execution.
  return Math.max(0,
    ...eligibleHits.filter(hit => hit.id === undefined || !periodicHitIds.has(hit.id))
      .map(hit => hit.frame + lastDeliveryOffset),
    ...entities.filter(entity => entity.hitIds.some(id => eligibleIds.has(id)))
      .map(entity => periodicLastHitFrame(entity) + lastDeliveryOffset));
}

/** Conservative finite queue horizon, relative to one accepted action input. */
export function actionPendingHorizonTicks(action: ActionDefinition, model?: WeaponProcModel): number {
  // Include every conditional hit: the action-time HP decision can select it.
  // Summon hit offsets already include spawn + lifetime + expiry attack delay.
  const lastHitSeconds = Math.max(0, ...(action.hits ?? []).map(hit => hit.offset));
  const lastPeriodicHit = Math.max(0, ...(action.periodicEntities ?? []).map(periodicLastHitFrame));
  const lastSummonFrame = Math.max(0, ...(action.summons ?? []).map(summon =>
    summon.spawnFrame + summon.lifetimeFrames + summon.expiryAttackDelayFrames));
  return Math.max(action.energyCostFrame ?? 0, action.staminaCost?.consumeFrame ?? 0,
    ...(action.healthChanges ?? []).map(change => change.frameOffset), lastSummonFrame, lastPeriodicHit,
    weaponProcPendingHorizonTicks(action.actorId, (action.hits ?? []).map(hit => ({ ...hit, frame: Math.ceil(hit.offset * 60) })), action.periodicEntities ?? [], model),
    // Preserve frame-native entity timing without a seconds round-trip.
    ...(action.periodicEntities?.length ? (action.particles ?? []).filter(particle => particle.trigger).map(particle =>
      lastPeriodicHit + Math.ceil(particle.travelTime * 60)) : []),
    Math.ceil(60 * Math.max(lastHitSeconds,
      ...(action.energyGains ?? []).map(gain => gain.offset ?? 0),
      ...(action.buffs ?? []).map(buff => buff.offset ?? 0),
      ...(action.debuffs ?? []).map(debuff => debuff.offset ?? 0),
      // Hit-confirm particles spawn immediately on a confirmed hit, then travel.
      // Keep the prior all-hit upper bound rather than assuming a branch fires.
      ...(action.particles ?? []).map(particle =>
        (particle.trigger ? lastHitSeconds : particle.spawnOffset ?? 0) + particle.travelTime))));
}

/** Same horizon for frame-native definitions before legal timeline compilation. */
export function abilityPendingHorizonTicks(ability: AbilityDefinition, model?: WeaponProcModel): number {
  const lastHit = Math.max(0, ...(ability.hits ?? []).map(hit => hit.frame),
    ...(ability.periodicEntities ?? []).map(periodicLastHitFrame));
  const lastSummonFrame = Math.max(0, ...(ability.summons ?? []).map(summon =>
    summon.spawnFrame + summon.lifetimeFrames + summon.expiryAttackDelayFrames));
  return Math.max(lastHit, ability.energyCostFrame ?? 0, ability.staminaCost?.consumeFrame ?? 0,
    ...(ability.healthChanges ?? []).map(change => change.frameOffset), lastSummonFrame,
    weaponProcPendingHorizonTicks(ability.actorId, ability.hits ?? [], ability.periodicEntities ?? [], model),
    ...(ability.energyGains ?? []).map(gain => gain.frame ?? 0),
    ...(ability.buffs ?? []).map(buff => buff.startFrame ?? 0),
    ...(ability.debuffs ?? []).map(debuff => debuff.startFrame ?? 0),
    ...(ability.particles ?? []).map(particle =>
      (particle.trigger ? lastHit : particle.spawnFrame ?? 0) + particle.travelFrames));
}
