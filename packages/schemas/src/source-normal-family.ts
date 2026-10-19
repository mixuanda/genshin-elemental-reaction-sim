import type { SimConfig } from "./types";

/** Fixed default-counter families only. This is identity metadata, not a
 * permissive pattern for arbitrary character normals or special stances. */
export const SOURCE_NORMAL_FAMILIES = [
  { id: "amber-normal-default-v1", sourceDirectory: "amber", actionIds: ["amber-n1", "amber-n2", "amber-n3", "amber-n4", "amber-n5"] },
  { id: "gorou-normal-default-v1", sourceDirectory: "gorou", actionIds: ["gorou-n1", "gorou-n2", "gorou-n3", "gorou-n4"] },
  { id: "kujousara-normal-default-v1", sourceDirectory: "sara", actionIds: ["kujousara-n1", "kujousara-n2", "kujousara-n3", "kujousara-n4", "kujousara-n5"] },
  { id: "diona-normal-default-v1", sourceDirectory: "diona", actionIds: ["diona-n1", "diona-n2", "diona-n3", "diona-n4", "diona-n5"] },
  { id: "collei-normal-default-v1", sourceDirectory: "collei", actionIds: ["collei-n1", "collei-n2", "collei-n3", "collei-n4"] },
  { id: "faruzan-normal-default-v1", sourceDirectory: "faruzan", actionIds: ["faruzan-n1", "faruzan-n2", "faruzan-n3", "faruzan-n4"] },
  { id: "ganyu-normal-default-v1", sourceDirectory: "ganyu", actionIds: ["ganyu-n1", "ganyu-n2", "ganyu-n3", "ganyu-n4", "ganyu-n5", "ganyu-n6"] },
  { id: "tighnari-normal-default-v1", sourceDirectory: "tighnari", actionIds: ["tighnari-n1", "tighnari-n2", "tighnari-n3", "tighnari-n4"] },
  { id: "venti-normal-default-v1", sourceDirectory: "venti", actionIds: ["venti-n1", "venti-n2", "venti-n3", "venti-n4", "venti-n5", "venti-n6"] },
  { id: "fischl-normal-default-v1", sourceDirectory: "fischl", actionIds: ["fischl-n1", "fischl-n2", "fischl-n3", "fischl-n4", "fischl-n5"] },
  { id: "yelan-normal-default-v1", sourceDirectory: "yelan", actionIds: ["yelan-n1", "yelan-n2", "yelan-n3", "yelan-n4"] },
 ] as const;
export type SourceNormalActionId = typeof SOURCE_NORMAL_FAMILIES[number]["actionIds"][number];
export const SOURCE_NORMAL_ACTION_IDS = SOURCE_NORMAL_FAMILIES.flatMap<SourceNormalActionId>(family => [...family.actionIds]);
export type SourceNormalStateScope = "fischl-no-oz-v1" | "yelan-no-burst-v1";

export function getSourceNormalChainMetadata(sourceActionId: string): { id: string; index: number; length: number } | undefined {
  for (const family of SOURCE_NORMAL_FAMILIES) {
    const actions: readonly string[] = family.actionIds;
    const index = actions.indexOf(sourceActionId);
    if (index >= 0) return { id: family.id, index: index + 1, length: actions.length };
  }
  return undefined;
}

/** These scopes explicitly exclude the character inputs which can establish
 * unimplemented summon/burst state; a missing declaration is never assumed. */
export function sourceNormalStateScopeConflicts(config: Pick<SimConfig, "sourceAbilityBindings" | "timeline">): Array<{ actorId: string; commandIndex: number; scope: SourceNormalStateScope }> {
  const scopes = new Map((config.sourceAbilityBindings ?? []).flatMap(binding =>
    binding.stateScope === undefined ? [] : [[binding.actorId, binding.stateScope] as const]));
  return (config.timeline?.commands ?? []).flatMap((command, commandIndex) => {
    if (!("actorId" in command)) return [];
    const scope = scopes.get(command.actorId);
    return scope !== undefined && (command.type === "burst" || scope === "fischl-no-oz-v1" && command.type === "skill")
      ? [{ actorId: command.actorId, commandIndex, scope }] : [];
  });
}
