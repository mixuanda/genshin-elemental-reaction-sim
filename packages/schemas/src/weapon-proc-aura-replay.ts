import type { AuraStateEntry, DamageEvent, SimulationResult } from "./types";

/**
 * Recover only the Cryo/Frozen presence predicates for ordinary, frame-native
 * deferred weapon callbacks in the parent's hit phase (3 or 13).
 *
 * Action/summon/periodic producers enqueue that phase's ordinary hits before
 * their damage callbacks; weapon procs land on the next frame. The caller
 * separately authenticates callback FIFO and its position after those hits.
 * Same-phase Quicken→Bloom follow-ups can change Hydro/Quicken, so this does
 * NOT claim equality of the entire Aura object at every callback. Their
 * resolveBloom branch neither consumes Cryo/Frozen nor runs Freeze. Special
 * lunar/stellar hosts are already excluded by the weapon-proc runtime contract.
 *
 * Shared timeline continuity carries natural-expiry/Reactable derived points
 * into the next observation. Include those points by emitted position, not a
 * made-up priority for their null tuples. Current-frame decay is materialized
 * before the ordinary hits. Do not read simulation-end or a later phase: its
 * Aura can include, for example, a priority-13 hit after a priority-3 callback.
 */
export function weaponProcTriggerAuraAtPhaseEnd(
  result: SimulationResult,
  parent: DamageEvent
): { cryo: boolean; frozen: boolean } {
  const points = result.targetStateTimeline.points;
  let phaseEndIndex = -1;
  for (let index = 0; index < points.length; index++) {
    const point = points[index]!;
    if (point.frame > parent.frame) break;
    if (point.cause === "simulation-end") continue;
    if (point.frame < parent.frame || point.cause === "simulation-start" ||
        point.eventPriority !== null && point.eventPriority <= parent.eventPriority) {
      phaseEndIndex = index;
    }
  }

  let aura: readonly AuraStateEntry[] = [];
  for (let index = 0; index <= phaseEndIndex; index++) {
    const point = points[index]!;
    if (point.targetId === parent.targetId && point.cause !== "simulation-end") {
      aura = point.auraAfter;
    }
  }
  return {
    cryo: aura.some(entry => entry.element === "cryo" && entry.gaugeUnits > 0),
    frozen: aura.some(entry => entry.element === "frozen" && entry.gaugeUnits > 0)
  };
}
