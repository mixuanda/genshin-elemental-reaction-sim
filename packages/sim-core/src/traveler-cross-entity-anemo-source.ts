import manifest from "../../game-data/sources/traveler-anemo-absorption/manifest.json";

export const TRAVELER_ANEMO_MAX_CONSTELLATION = 6;
export const TRAVELER_ANEMO_ABSORPTION_EVIDENCE = manifest;
export const TRAVELER_ANEMO_ABSORPTION_SOURCE_REFS = manifest.files.map(file => file.url);
export const TRAVELER_ANEMO_ABSORPTION_CHECK_FRAMES: readonly number[] = manifest.behavior.absorptionChecks;
export const travelerAnemoAbsorbedCoefficient = (level: number): number | undefined =>
  Number.isInteger(level) && level >= 1 && level <= 15 ? manifest.coefficients.optimizerM[level - 1] : undefined;
