import manifest from "../sources/weapon-procs/manifest.json";
import optimizer from "../sources/weapon-procs/manifest-go.json";
export { weaponProcDefinitions, getWeaponProcDefinition, type WeaponProcDefinition, type WeaponProcId } from "@genshin-dps-lab/reaction-formulas";
export const weaponProcSourceEvidence = {...manifest, optimizer};
