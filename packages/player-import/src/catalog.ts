import projection from "./catalog.generated.json" with { type: "json" };
import goodIdentities from "../../game-data/sources/build-import/identity-maps.json" with { type: "json" };
import relics from "../../game-data/sources/build-import/libs__gi__dm__src__dm__artifact__ReliquaryExcelConfigData_idmap_gen.json" with { type: "json" };

interface Character { id: string; avatarId: number; name: string; weaponType: string; rarity: number }
interface Weapon { id: string; itemId: number; name: string; weaponType: string; rarity: number }
interface Mapping { avatarId: number; variantKey: string; skillOrder: number[]; proudMap: Record<string, number> }
interface SetEntry { id: string; numericId: number; name: string; rarityList: number[]; slots: { slot: string }[] }
const data = projection as unknown as { revision: string; characters: Character[]; weapons: Weapon[]; mappings: Mapping[]; sets: SetEntry[] };
export const catalog = {
  revision: data.revision,
  characters: new Map(data.characters.map(c => [c.avatarId, c])),
  weapons: new Map(data.weapons.map(w => [w.itemId, w])),
  mappings: data.mappings,
  sets: new Map(data.sets.map(s => [s.numericId, s])),
  good: goodIdentities as unknown as { character: Record<string, number>; weapon: Record<string, number>; artifact: Record<string, number> },
  relics: relics as unknown as Record<string, [number | null, string]>
};
