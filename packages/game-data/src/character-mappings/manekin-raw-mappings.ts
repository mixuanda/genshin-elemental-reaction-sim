import type { GameDataCatalog } from "@genshin-dps-lab/schemas";
import type { SourceHitMapping } from "./types";
import definitions from "../../sources/manekin-raw-casts/definitions.json";
import manifest from "../../sources/manekin-raw-casts/manifest.json";

export const manekinRawSourceEvidence = manifest;
export const manekinRawCharacters = definitions.characters;
export const manekinRawCoefficients = definitions.coefficients;
export const manekinRawStateContracts = definitions.stateContracts;
export const manekinRawPendingMechanics = definitions.pendingMechanics;

/** A separate, explicitly raw-only supplement. Never overwrite imported catalog
 * records or present these values as an independent numerical cross-check. */
export const manekinTalentSupplement = definitions.talentSupplement as GameDataCatalog["talentSets"];
export function getManekinSupplementalTalentSet(characterId: string, talentSetId: string): GameDataCatalog["talentSets"][number] | undefined {
  if (!manekinRawCharacters.some(character => character.characterId === characterId && character.talentSetId === talentSetId)) return undefined;
  return manekinTalentSupplement.find(talent => talent.id === talentSetId);
}

export interface ManekinRawRole {
  id: string; label: string; coefficientId: string; parameterKey: string;
  scalingStat: "atk"; element: SourceHitMapping["element"];
  attackTag: "normal" | "charged" | "plunge" | "skill"; instanceCount: number;
}
export interface ManekinRawTemplate {
  skillId: string; characterSlug: "manekin" | "manekina"; characterId: string;
  talentSetId: string; abilityKey: "combat1" | "combat2"; abilityId: string;
  label: string; stateContract: "manekin-uninfused-base" | "manekin-elemental-skill";
  variantId: string; variantName: string; skillDepotId?: number;
  completeAction: true; roles: ManekinRawRole[]; sourcePaths: string[];
  assumptions: string[]; exclusions: string[];
}
export const manekinRawTemplates = definitions.templates as ManekinRawTemplate[];
const coefficients = new Map(manekinRawCoefficients.map(row => [row.id, row]));

export const manekinRawMappings: SourceHitMapping[] = manekinRawTemplates.flatMap(template => template.roles.map(role => {
  const coefficient = coefficients.get(role.coefficientId);
  if (!coefficient) throw new Error(`Missing reviewed Manekin coefficient: ${role.coefficientId}`);
  return {
    id: role.id, characterSlug: template.characterSlug,
    variantId: template.variantId, variantName: template.variantName,
    talentSetId: template.talentSetId, abilityKey: template.abilityKey, parameterKey: role.parameterKey,
    skillId: template.skillId, skillLabel: template.label, hitLabel: role.label,
    element: role.element, attackTag: role.attackTag, scalingStat: role.scalingStat,
    instanceCount: role.instanceCount, sourceCoefficientValues: coefficient.values, coefficientTolerance: 0,
    sourceRepository: "Dimbreath/AnimeGameData2", sourceHost: "gitlab", sourceCommit: manifest.revision,
    numericEvidenceStatus: "single-source-extracted", sourcePaths: template.sourcePaths,
    assumptions: template.assumptions, exclusions: template.exclusions, completeAction: true,
  };
}));
