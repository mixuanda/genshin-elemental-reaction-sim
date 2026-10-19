import { equipmentDatasetSource, type EquipmentDataset } from "./equipment-dataset";

/** Default identity is retained for existing released consumers. Explicit datasets
 * never consult this singleton when rendering a source link. */
export const equipmentDataSource = equipmentDatasetSource();

export function equipmentDescriptionSource(category: "weapons" | "artifacts", slug: string, dataset?: EquipmentDataset): string {
  return `${equipmentDatasetSource(dataset).root}/src/data/ChineseSimplified/${category}/${slug}.json`;
}

export function equipmentStatSource(category: "characters" | "weapons", slug: string, dataset?: EquipmentDataset): string {
  return `${equipmentDatasetSource(dataset).root}/src/data/stats/${category}.json#/${slug}`;
}
