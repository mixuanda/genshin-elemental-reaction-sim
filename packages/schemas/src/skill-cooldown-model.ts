import type { SimConfig } from "./types";

/** Explicit SetCD timing opts every skill variant into the actor's shared E slot.
 * Sacrificial holders use the same runtime queue even without a timing override. */
export function getRuntimeSkillCooldownActors(
  config: Pick<SimConfig, "timeline" | "sacrificialModel"> & { artifactEventModel?: Pick<NonNullable<SimConfig["artifactEventModel"]>, "actors"> }
): ReadonlySet<string> {
  const actors = new Set(config.sacrificialModel?.actors.map(actor => actor.actorId) ?? []);
  for (const actor of config.artifactEventModel?.actors ?? []) if (actor.effectId === "gambler-4pc") actors.add(actor.actorId);
  for (const ability of config.timeline?.abilities ?? []) {
    if (ability.kind === "skill" && ability.cooldownStartFrame !== undefined) actors.add(ability.actorId);
  }
  return actors;
}
