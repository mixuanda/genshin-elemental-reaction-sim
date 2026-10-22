import {
  gameDataRuntimeIndexSchema,
  type GameDataRuntimeIndex
} from "@genshin-dps-lab/schemas";
import { activeCatalogIndexData as rawIndex } from "../manifests/runtime/current";

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
  mapping: GameDataRuntimeIndex["enkaCharacterMappings"][number] | null,
  catalog: GameDataRuntimeIndex = gameDataRuntimeIndex
) {
  const talentSet = (id: string) => catalog === gameDataRuntimeIndex
    ? talentSetById.get(id)
    : catalog.talentSets.find(entry => entry.id === id);
  if (character.talentSetIds.length === 1) {
    return talentSet(character.talentSetIds[0]!) ?? null;
  }
  if (mapping === null || mapping.avatarId !== character.avatarId || mapping.element === "unknown") return null;
  const candidates = character.talentSetIds
    .map(talentSet)
    .filter(entry => entry?.id === `talent-set:traveler${mapping.element}`);
  return candidates.length === 1 ? candidates[0] ?? null : null;
}

export function findRuntimeEnkaCharacterMapping(
  avatarId: number,
  skillIds: readonly string[] = [],
  catalog: GameDataRuntimeIndex = gameDataRuntimeIndex
) {
  const candidates = catalog === gameDataRuntimeIndex
    ? enkaMappingsByAvatarId.get(avatarId) ?? []
    : catalog.enkaCharacterMappings.filter(entry => entry.avatarId === avatarId);
  const character = catalog === gameDataRuntimeIndex
    ? findRuntimeCharacterByAvatarId(avatarId)
    : catalog.characters.find(entry => entry.avatarId === avatarId);
  if (candidates.length <= 1 && character?.element !== "unknown") {
    return candidates[0] ?? null;
  }
  // A multi-element identity needs actual skill evidence. Never pick the first
  // catalog row when there are no positive matches or equally plausible variants.
  const requested = new Set(skillIds);
  const scored = candidates.map(mapping => ({
    mapping,
    score: mapping.skillOrder.filter(id => requested.has(String(id))).length
  }));
  const bestScore = Math.max(0, ...scored.map(entry => entry.score));
  if (bestScore === 0) return null;
  const best = scored.filter(entry => entry.score === bestScore);
  if (best.length !== 1) return null;
  const mapping = best[0]!.mapping;
  // Mixed elements/genders and unknown IDs cannot identify a single variant.
  return skillIds.every(id => mapping.skillOrder.some(known => String(known) === id)) ? mapping : null;
}
