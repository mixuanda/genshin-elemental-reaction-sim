import {
  gameDataRuntimeIndexSchema,
  type GameDataRuntimeIndex
} from "@genshin-dps-lab/schemas";
import rawIndex from "./generated/catalog-index.zh-CN.json";

export const gameDataRuntimeIndex: GameDataRuntimeIndex =
  gameDataRuntimeIndexSchema.parse(rawIndex as unknown);

const characterByAvatarId = new Map(
  gameDataRuntimeIndex.characters.map((entry) => [entry.avatarId, entry])
);
const weaponByItemId = new Map(
  gameDataRuntimeIndex.weapons.map((entry) => [entry.itemId, entry])
);
const talentSetById = new Map(
  gameDataRuntimeIndex.talentSets.map((entry) => [entry.id, entry])
);
const enkaMappingsByAvatarId = new Map<
  number,
  GameDataRuntimeIndex["enkaCharacterMappings"]
>();
for (const entry of gameDataRuntimeIndex.enkaCharacterMappings) {
  const mappings = enkaMappingsByAvatarId.get(entry.avatarId) ?? [];
  mappings.push(entry);
  enkaMappingsByAvatarId.set(entry.avatarId, mappings);
}

export function findRuntimeCharacterByAvatarId(avatarId: number) {
  return characterByAvatarId.get(avatarId) ?? null;
}

export function findRuntimeWeaponByItemId(itemId: number) {
  return weaponByItemId.get(itemId) ?? null;
}

export function findRuntimeTalentSetForCharacter(
  character: GameDataRuntimeIndex["characters"][number],
  mapping: GameDataRuntimeIndex["enkaCharacterMappings"][number] | null
) {
  if (character.talentSetIds.length === 1) {
    return talentSetById.get(character.talentSetIds[0]!) ?? null;
  }
  if (mapping?.element === "unknown") return null;
  return (
    character.talentSetIds
      .map((id) => talentSetById.get(id))
      .find((entry) => entry?.id.endsWith(`traveler${mapping?.element}`)) ??
    null
  );
}

export function findRuntimeEnkaCharacterMapping(
  avatarId: number,
  skillIds: readonly string[] = []
) {
  const candidates = enkaMappingsByAvatarId.get(avatarId) ?? [];
  if (candidates.length <= 1 || skillIds.length === 0) {
    return candidates[0] ?? null;
  }
  const requested = new Set(skillIds.map(Number));
  return (
    [...candidates].sort((left, right) => {
      const score = (entry: (typeof candidates)[number]) =>
        entry.skillOrder.filter((skillId) => requested.has(skillId)).length;
      return score(right) - score(left);
    })[0] ?? null
  );
}
