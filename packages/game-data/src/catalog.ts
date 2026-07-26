import {
  migrateGameDataCatalog,
  type CharacterCatalogEntry,
  type GameDataCatalog,
  type TalentSetCatalogEntry,
  type WeaponCatalogEntry
} from "@genshin-dps-lab/schemas";
import rawCatalog from "./generated/catalog.zh-CN.json";

export const gameDataCatalog: GameDataCatalog = migrateGameDataCatalog(
  rawCatalog as unknown
);

const characterByAvatarId = new Map(
  gameDataCatalog.characters.map((entry) => [entry.avatarId, entry])
);
const weaponByItemId = new Map(
  gameDataCatalog.weapons.map((entry) => [entry.itemId, entry])
);
const talentSetById = new Map(
  gameDataCatalog.talentSets.map((entry) => [entry.id, entry])
);
const enkaMappingByAvatarId = new Map(
  gameDataCatalog.enkaCharacterMappings.map((entry) => [
    entry.avatarId,
    entry
  ])
);

export function findCharacterByAvatarId(
  avatarId: number
): CharacterCatalogEntry | null {
  return characterByAvatarId.get(avatarId) ?? null;
}

export function findWeaponByItemId(
  itemId: number
): WeaponCatalogEntry | null {
  return weaponByItemId.get(itemId) ?? null;
}

export function findTalentSetById(
  talentSetId: string
): TalentSetCatalogEntry | null {
  return talentSetById.get(talentSetId) ?? null;
}

export function findCanonicalTalentSet(
  character: CharacterCatalogEntry
): TalentSetCatalogEntry | null {
  if (character.talentSetIds.length !== 1) return null;
  return talentSetById.get(character.talentSetIds[0]!) ?? null;
}

export function findEnkaCharacterMapping(avatarId: number) {
  return enkaMappingByAvatarId.get(avatarId) ?? null;
}
