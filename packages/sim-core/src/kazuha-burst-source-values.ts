import manifest from "../../game-data/sources/kazuha-burst/manifest.json";

const vector = (name: string): readonly number[] => {
  const found = manifest.coefficients.find(row => row.sourceTable === name);
  if (!found || found.values.length !== 15) throw new Error(`Missing pinned Kazuha Q vector: ${name}`);
  return found.values;
};
export const KAZUHA_BURST_SOURCE_VALUES = {
  slash: vector("burstSlash"), anemoDot: vector("burstDot"), absorbedDot: vector("burstEleDot"),
} as const;
export const KAZUHA_BURST_SNAPSHOT_FRAME = 81;
export const KAZUHA_BURST_SLASH_FRAME = 82;
export const KAZUHA_BURST_TICK_FRAMES = [140, 257, 374, 491, 608] as const;
export const KAZUHA_BURST_ABSORPTION_CHECK_FRAMES = Array.from({length: 17}, (_, index) => 81 + 18 * index);
export const KAZUHA_BURST_SOURCE_REFS = manifest.files.map(row =>
  `https://github.com/genshinsim/gcsim/blob/${row.revision}/${row.path}`);
